export type DevUser = {
  password: string;
  role: string;
  nombre: string;
};

export const DEV_USERS: Record<string, DevUser> = {
  "admin@propcrm.com": {
    password: "Admin1234!",
    role: "admin",
    nombre: "Administrador",
  },
  "cliente@propcrm.com": {
    password: "Cliente1234!",
    role: "cliente",
    nombre: "Cliente Demo",
  },
  "vendedor@propcrm.com": {
    password: "Vendedor1234!",
    role: "vendedor",
    nombre: "Carlos Martínez",
  },
};
