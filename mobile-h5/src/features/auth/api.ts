import { requestData } from "../../api/client";
import type { LoginPayload, LoginResult, MemberUser } from "./types";

export function loginMember(payload: LoginPayload) {
  return requestData<LoginResult>({
    method: "POST",
    url: "/auth/login",
    data: payload,
  });
}

export function fetchMe() {
  return requestData<MemberUser>({
    method: "GET",
    url: "/me",
  });
}
