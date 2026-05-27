export function GET(): Response {
  return Response.json({
    service: "foodtruckzs-web",
    status: "ok",
  });
}
