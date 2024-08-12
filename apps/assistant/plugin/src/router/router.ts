import { showUI as showURL } from "@h20/figma-tools";

export const openIndexPage = () => {
  const showUIStrategy =
    process.env.VITE_ENV === "development" ? showURL.bind(null, `${process.env.VITE_WEB_HOST}/index.html?t=${Date.now()}`) : figma.showUI.bind(null, __html__);

  showUIStrategy({
    height: 800,
    width: 420,
  });
};
