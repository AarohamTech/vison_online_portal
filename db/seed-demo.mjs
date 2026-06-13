/**
 * Seed a demo project with folders, images, and a label file (DB + S3).
 * Idempotent-ish: deletes any existing project named "Demo Inspection" first.
 *
 *   node db/seed-demo.mjs           # create
 *   node db/seed-demo.mjs --clean   # remove only
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import zlib from "node:zlib";
import postgres from "postgres";
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

const sql = postgres(process.env.DATABASE_URL, { prepare: false });
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.S3_BUCKET_NAME;
const NAME = "Demo Inspection";

// --- minimal solid-color PNG encoder ---
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function makePNG(size, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0;
    for (let x = 0; x < size; x++) {
      raw[o++] = r; raw[o++] = g; raw[o++] = b;
    }
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

async function cleanProject(id) {
  const l = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: `projects/${id}/` }));
  if (l.Contents?.length)
    await s3.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects: l.Contents.map((o) => ({ Key: o.Key })) } }));
  await sql`delete from projects where id=${id}`;
}

async function run() {
  const adminId = (await sql`select id from profiles where role='admin' limit 1`)[0].id;

  // remove prior demo
  const existing = await sql`select id from projects where name=${NAME}`;
  for (const r of existing) await cleanProject(r.id);

  if (process.argv.includes("--clean")) {
    console.log("Cleaned demo project(s).");
    await sql.end();
    return;
  }

  const [proj] = await sql`
    insert into projects (name, customer_name, product_name, description, status, created_by)
    values (${NAME}, 'Acme Robotics', 'Conveyor-X', 'Demo data for UI preview', 'active', ${adminId})
    returning id, created_at`;
  const id = proj.id;
  const base = `projects/${id}/`;
  const now = proj.created_at.toISOString();

  await s3.send(new PutObjectCommand({
    Bucket, Key: `${base}metadata.json`, ContentType: "application/json",
    Body: JSON.stringify({ projectId: id, projectName: NAME, customerName: "Acme Robotics", productName: "Conveyor-X", createdAt: now, updatedAt: now, createdBy: adminId, folderStructureVersion: "1.0" }, null, 2),
  }));

  const colors = [[59,130,246],[16,185,129],[244,63,94],[234,179,8],[168,85,247],[14,165,233]];
  const trainFiles = [
    { name: "sample_001.png", folder: "" },
    { name: "ok_001.png", folder: "defect_dataset/ok" },
    { name: "ok_002.png", folder: "defect_dataset/ok" },
    { name: "ng_crack_001.png", folder: "defect_dataset/ng/crack" },
    { name: "ng_crack_002.png", folder: "defect_dataset/ng/crack" },
    { name: "ng_scratch_001.png", folder: "defect_dataset/ng/scratch" },
  ];

  let ci = 0;
  for (const f of trainFiles) {
    const key = `${base}train-data/raw/${f.folder ? f.folder + "/" : ""}${f.name}`;
    const png = makePNG(64, colors[ci++ % colors.length]);
    await s3.send(new PutObjectCommand({ Bucket, Key: key, Body: png, ContentType: "image/png" }));
    await sql`
      insert into files (project_id, bucket, object_key, file_name, file_type, mime_type, size, section, folder_path, uploaded_by)
      values (${id}, ${Bucket}, ${key}, ${f.name}, 'png', 'image/png', ${png.length}, 'train_data', ${f.folder}, ${adminId})`;
  }

  // a label file in annotated under the admin's user folder
  const labelBody = JSON.stringify({ image: "ng_crack_001.png", boxes: [{ x: 10, y: 12, w: 20, h: 8, label: "crack" }] }, null, 2);
  const labelKey = `${base}annotated/final_labels/${adminId}/ng_crack_001.json`;
  await s3.send(new PutObjectCommand({ Bucket, Key: labelKey, Body: labelBody, ContentType: "application/json" }));
  await sql`
    insert into files (project_id, bucket, object_key, file_name, file_type, mime_type, size, section, folder_path, uploaded_by)
    values (${id}, ${Bucket}, ${labelKey}, 'ng_crack_001.json', 'json', 'application/json', ${Buffer.byteLength(labelBody)}, 'annotated', ${adminId}, ${adminId})`;

  await sql`insert into activity_logs (project_id, user_id, action, target_type, target_id, details)
    values (${id}, ${adminId}, 'project_created', 'project', ${id}, ${sql.json({ name: NAME })})`;

  console.log("Demo project created:", id);
  console.log("  train-data: 6 images across defect_dataset/ok, ng/crack, ng/scratch");
  console.log("  annotated:  1 label json");
  await sql.end();
}

run().catch((e) => { console.error(e); process.exit(1); });
