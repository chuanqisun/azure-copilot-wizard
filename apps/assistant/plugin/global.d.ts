declare module "*.svg" {
  const src: string;
  export default src;
}

declare module "*.png" {
  const dataurl: string;
  export default dataurl;
}
