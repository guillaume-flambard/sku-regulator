import { z } from "zod";

// Editable knobs surfaced in Remotion Studio / regenerable by an agent without
// touching the React code. Defined in its own file to avoid an import cycle
// between DemoVideo (consumes) and index (registers the Composition).
export const demoVideoSchema = z.object({
  scenes: z.array(z.string()).optional(),
  endCard: z.object({
    title: z.string(),
    tagline: z.string(),
    credit: z.string(),
  }),
});

export type DemoVideoProps = z.infer<typeof demoVideoSchema>;
