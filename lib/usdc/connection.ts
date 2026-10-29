// Tab-memory only. Never persisted in a backup, URL, cookie or browser storage.
let connection: { mode: "browser" | "server"; token: string } = {
  mode: "browser",
  token: "",
};
export const getConnection = () => connection;
export const setConnection = (next: typeof connection) => {
  connection = next;
};
