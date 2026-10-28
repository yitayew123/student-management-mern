import api from "../../../api/axiosClient";

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

export async function getRolePermissions() {
  const response = await api.get("/admin/role-permissions");
  return unwrap(response);
}

export async function updateRolePermissions(role, permissions) {
  const response = await api.patch(
    `/admin/role-permissions/${encodeURIComponent(role)}`,
    { permissions },
  );
  return unwrap(response);
}
