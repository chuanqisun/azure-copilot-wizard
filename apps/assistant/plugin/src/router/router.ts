import { showUI } from "@h20/figma-tools";

export const openIndexPage = () => showUI(`${process.env.VITE_WEB_HOST}/index.html?t=${Date.now()}`, { height: 800, width: 420 });
