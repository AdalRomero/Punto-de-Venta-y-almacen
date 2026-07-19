/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.jpeg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

export { };

declare global {
  interface Window {
    api: {
      query: (sql: string, params?: any[]) => Promise<any>;
      execute: (sql: string, params?: any[], entity?: string) => Promise<any>;
      onChange: (callback: (entity: string) => void) => () => void;
      users: {
        crear: (input: {
          usuario: string;
          nombres: string;
          apellido_paterno: string;
          apellido_materno: string | null;
          rol: string;
          correo_acceso: string;
          password: string;
          correo_personal: string | null;
          lada: string | null;
          telefono: string | null;
          direccion: string | null;
        }) => Promise<string>;
        asignarCredenciales: (payload: {
          id_perfil_info: string;
          correo_acceso: string;
          password: string;
        }) => Promise<void>;
        cambiarPassword: (payload: { id_perfil_info: string; password: string }) => Promise<void>;
        revocarCredenciales: (idPerfilInfo: string) => Promise<void>;
      };
    };
  }
}