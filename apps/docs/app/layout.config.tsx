import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { glyphs } from "@/components/nf-icon";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="font-bold inline-flex items-center gap-2.5">
        <span className="text-rust-500">{glyphs.comet}</span>
        <span>
          val<span className="text-rust-500">rs</span>
        </span>
      </span>
    ),
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
      icon: <span className="text-sm">{glyphs.book}</span>,
    },
    {
      text: "GitHub",
      url: "https://github.com/douglance/valrs",
      icon: <span className="text-sm">{glyphs.github}</span>,
    },
  ],
  githubUrl: "https://github.com/douglance/valrs",
};
