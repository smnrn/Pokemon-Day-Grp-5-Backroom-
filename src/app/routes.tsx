import { lazy } from "react"
import {
  createBrowserRouter,
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
} from "react-router"
import { applicationBase, isAuthenticationCallback } from "./route-model"
import { RouteLoadBoundary } from "./RouteLoadBoundary"

const LandingPage = lazy(() =>
  import("../companion/LandingExperience").then((module) => ({
    default: module.LandingExperience,
  })),
)
const LoginPage = lazy(() =>
  import("./ProtectedPages").then((module) => ({ default: module.LoginPage })),
)
const CompanionPage = lazy(() =>
  import("./ProtectedPages").then((module) => ({
    default: module.CompanionPage,
  })),
)
const AdminPage = lazy(() =>
  import("./ProtectedPages").then((module) => ({ default: module.AdminPage })),
)
const GamePage = lazy(() =>
  import("./ProtectedPages").then((module) => ({ default: module.GamePage })),
)

function PublicPage() {
  const location = useLocation()
  return isAuthenticationCallback(location.search, location.hash) ? (
    <Navigate replace to={`/login${location.search}${location.hash}`} />
  ) : (
    <LandingPage />
  )
}
function AuthAlias() {
  const location = useLocation()
  return <Navigate replace to={`/login${location.search}${location.hash}`} />
}
function RouteFrame() {
  return (
    <>
      <Outlet />
      <ScrollRestoration />
    </>
  )
}
export const router = createBrowserRouter(
  [
    {
      Component: RouteFrame,
      ErrorBoundary: RouteLoadBoundary,
      children: [
        { path: "/", Component: PublicPage },
        { path: "/login", Component: LoginPage },
        { path: "/auth", Component: AuthAlias },
        { path: "/app", Component: CompanionPage },
        { path: "/admin", Component: AdminPage },
        { path: "/game", Component: GamePage },
        { path: "*", element: <Navigate replace to="/" /> },
      ],
    },
  ],
  { basename: applicationBase(import.meta.env.BASE_URL) },
)
