import api from "../../../api/axiosClient";

function unwrap(response) {
  return response?.data?.data ?? response?.data;
}

export async function getUsers(params = {}) {
  const response = await api.get("/admin/users", { params });
  const result = unwrap(response);
  return {
    items: result?.users ?? result?.items ?? [],
    pagination: result?.pagination ?? null,
  };
}

export async function createUser(payload) {
  const response = await api.post("/admin/users", payload);
  const result = unwrap(response);
  return result?.user ?? result;
}

export async function changeUserStatus(id, isActive) {
  const response = await api.patch(
    `/admin/users/${encodeURIComponent(id)}/status`,
    { isActive },
  );
  const result = unwrap(response);
  return result?.user ?? result;
}
