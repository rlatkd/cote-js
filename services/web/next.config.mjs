/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // instrumentation.ts(OTel 등록)를 켠다 — Next 15에서 정식 승격되면 이 플래그는 제거
    instrumentationHook: true,
  },
};

export default nextConfig;
