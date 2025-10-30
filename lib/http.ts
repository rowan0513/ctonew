export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  const remoteAddress = request.headers.get("forwarded");
  if (remoteAddress) {
    const match = /for="?([^;",]+)"?/i.exec(remoteAddress);
    if (match?.[1]) {
      return match[1];
    }
  }

  return "unknown";
}
