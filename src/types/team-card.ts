import type { ImageMetadata } from "astro";

export interface TeamCardProps {
    img: ImageMetadata;
    specialization: string;
    name: string;
    experience: string;
}
