"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import {
  createProjectAction,
  type CreateProjectState,
} from "@/lib/projects/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const initial: CreateProjectState = { error: null };

function FieldError({ errors }: { errors?: string[] }) {
  if (!errors?.length) return null;
  return <p className="text-xs text-destructive">{errors[0]}</p>;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending && <Loader2 className="mr-2 size-4 animate-spin" />}
      {pending ? "Creating…" : "Create Project"}
    </Button>
  );
}

export function CreateProjectForm() {
  const [state, action] = useActionState(createProjectAction, initial);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-2">
        <Label htmlFor="name">Project name</Label>
        <Input id="name" name="name" placeholder="e.g. Bottle Cap Inspection" required />
        <FieldError errors={fe.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="customerName">Customer</Label>
          <Input id="customerName" name="customerName" placeholder="Acme Corp" required />
          <FieldError errors={fe.customerName} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="productName">Product</Label>
          <Input id="productName" name="productName" placeholder="Cap-200" required />
          <FieldError errors={fe.productName} />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="Optional notes about this project…"
          className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <FieldError errors={fe.description} />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="status">Status</Label>
        <Select name="status" defaultValue="active">
          <SelectTrigger id="status" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on_hold">On hold</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        On creation we automatically provision the folder structure
        (<span className="font-mono">Installer</span>,{" "}
        <span className="font-mono">Train Data/raw</span>,{" "}
        <span className="font-mono">Annotated/final_labels</span>) and write{" "}
        <span className="font-mono">metadata.json</span> to storage.
      </div>

      {state.error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <SubmitButton />
        <Button asChild variant="ghost">
          <Link href="/projects">Cancel</Link>
        </Button>
      </div>
    </form>
  );
}
