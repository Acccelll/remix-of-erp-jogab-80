/** @module-kind io */
import { apiFetch } from "@/lib/api";

export const featureFlagsRepo = {
  async list() {
    try {
      return await apiFetch<any[]>("featureFlags");
    } catch (err) {
      console.error("featureFlagsRepo.list error", err);
      return [];
    }
  },
  async toggle(id: string, enabled: boolean, updated_by: string | null) {
    return await apiFetch("featureFlags", {
      method: "PUT",
      params: { id },
      body: { enabled, updated_by },
    });
  },
  async remove(id: string) {
    return await apiFetch("featureFlags", {
      method: "DELETE",
      params: { id },
    });
  },
  async insert(payload: Record<string, unknown>) {
    return await apiFetch("featureFlags", {
      method: "POST",
      body: payload,
    });
  },
  async isEnabled(flagKey: string, obraId: string | null) {
    try {
      const data = await this.list();
      const flag = data.find((f) => f.flag_key === flagKey && f.obra_id === obraId);
      return flag ? Boolean(flag.enabled) : false;
    } catch {
      return false;
    }
  },
};

