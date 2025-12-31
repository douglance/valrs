import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { createMDX } from "fumadocs-mdx/next";

initOpenNextCloudflareForDev();

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
};

export default withMDX(config);
