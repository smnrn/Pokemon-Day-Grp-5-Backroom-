import { lazy } from "react"
import { Navigate, useSearchParams } from "react-router"
import { AccountBoundary, GameCheckIn, useAccount } from "../companion/Access"
import { loginDestination } from "./route-model"

const Game = lazy(() => import("../App"))
const Companion = lazy(() => import("../companion/Companion"))

function AfterLogin() {
  const { account } = useAccount()
  const [params] = useSearchParams()
  return (
    <Navigate replace to={loginDestination(account.role, params.get("next"))} />
  )
}
export function LoginPage() {
  return (
    <AccountBoundary loginPage>
      <AfterLogin />
    </AccountBoundary>
  )
}
export function CompanionPage() {
  return (
    <AccountBoundary>
      <Companion />
    </AccountBoundary>
  )
}
function AdministratorCompanion() {
  const { account } = useAccount()
  return account.role === "admin" ? (
    <Companion initialTab="analytics" />
  ) : (
    <Navigate replace to="/app" />
  )
}
export function AdminPage() {
  return (
    <AccountBoundary>
      <AdministratorCompanion />
    </AccountBoundary>
  )
}
export function GamePage() {
  return (
    <AccountBoundary>
      <GameCheckIn>
        <Game />
      </GameCheckIn>
    </AccountBoundary>
  )
}
