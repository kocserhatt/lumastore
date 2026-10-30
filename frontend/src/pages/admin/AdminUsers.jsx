import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/context/StoreContext";
import { errMsg } from "@/lib/shop";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ROLE_LABELS = { admin: "Yönetici", member: "Müşteri" };

export const AdminUsers = () => {
  const { authed, me } = useStore();
  const [data, setData] = useState({ roles: [], users: [] });
  const load = useCallback(() => authed("get", "/users").then(setData), [authed]);
  useEffect(() => { load(); }, [load]);

  const change = async (uid, role) => {
    try {
      await authed("patch", `/users/${uid}/role`, { role });
      toast.success("Rol güncellendi");
      load();
    } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <ul className="space-y-3">
      {data.users.map((u) => (
        <li key={u.user_id} data-testid={`admin-user-row-${u.user_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-orange-100 bg-white p-4">
          <div className="text-sm font-semibold">{u.email || u.user_id}{u.user_id === me?.user_id && <span className="ml-2 text-xs text-zinc-400">(sen)</span>}</div>
          <Select value={u.role} onValueChange={(r) => change(u.user_id, r)}>
            <SelectTrigger className="h-10 w-36 rounded-full" data-testid={`admin-user-role-${u.user_id}`}><SelectValue /></SelectTrigger>
            <SelectContent>{data.roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>)}</SelectContent>
          </Select>
        </li>
      ))}
    </ul>
  );
};
