import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: (
      <span className="font-bold">
        val<span className="text-emerald-500">rs</span>
      </span>
    ),
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "GitHub",
      url: "https://github.com/douglance/valrs",
    },
  ],
  githubUrl: "https://github.com/douglance/valrs",
};
