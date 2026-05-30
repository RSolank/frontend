import { z } from 'zod';

// Form schema for the Create / Update Tag dialog. `parent` is the
// stringified tag_id from the <select>; transformed to number | null on
// submit. `aliases` is the chip-array shape — the legacy server accepts
// the array directly.
export const tagFormSchema = z.object({
  tag_name: z.string().trim().min(1, 'Tag name is required'),
  parent: z.string().optional().default(''),
  tag_type: z
    .enum(['essential', 'discretionary', 'committed', 'exempted', 'income'])
    .default('discretionary'),
  aliases: z.array(z.string().trim().min(1)).default([]),
});
export type TagFormInput = z.infer<typeof tagFormSchema>;

// Server-shape payload (matches the legacy POST/PATCH body).
export interface TagPayload {
  tag_name: string;
  parent: number | null;
  tag_type: TagFormInput['tag_type'];
  aliases: string[];
}

export function tagFormToPayload(form: TagFormInput): TagPayload {
  return {
    tag_name: form.tag_name.trim(),
    parent: form.parent ? parseInt(form.parent, 10) : null,
    tag_type: form.tag_type,
    aliases: form.aliases,
  };
}
