import { z } from "zod";
import { PROJECT_STATUSES } from "@/types";

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  customerName: z.string().trim().min(1, "Customer is required").max(120),
  productName: z.string().trim().min(1, "Product is required").max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  status: z.enum(PROJECT_STATUSES as [string, ...string[]]).default("active"),
});

export type CreateProjectValues = z.infer<typeof createProjectSchema>;
