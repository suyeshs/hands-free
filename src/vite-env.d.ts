/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VARIANT: 'staff' | 'owner';
  readonly VITE_STAFF_BUILD: string;
  readonly VITE_ALLOWED_MODES: string;
  readonly VITE_BACKEND_API_URL?: string;
  readonly VITE_BACKEND_WS_URL?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_USE_MOCK_REGISTRY?: string;
  readonly VITE_PLUGIN_REGISTRY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
