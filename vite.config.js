import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        appointments: "afspraken.html",
        people: "mensen.html",
        reader: "mama.html",
        phones: "telefoons.html",
      },
    },
  },
});
