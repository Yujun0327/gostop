import { loadPlayerName } from '@yujun/game-net'
import { DAILY_CASH, Ledger, LEDGER, loadIdentity, type Identity, type Profile } from '@yujun/game-net/wallet'
import { APP } from './persist'

const NEXT_CLAIM_KEY = 'yujungame:next-claim'
export const PORTAL_URL = 'https://yujun0327.github.io/boardgames/'

/** The player's platform wallet, as seen from this game: balance, trophies, daily claim. */
class WalletStore {
  readonly identity: Identity = loadIdentity()
  readonly ledger: Ledger | null = LEDGER ? new Ledger(LEDGER) : null
  profile = $state<Profile | null>(null)
  nextClaimAt = $state<number>(Number(localStorage.getItem(NEXT_CLAIM_KEY) ?? 0))
  busy = $state(false)
  notice = $state('')

  get configured(): boolean {
    return this.ledger !== null
  }

  get canClaim(): boolean {
    return this.configured && !this.busy && Date.now() >= this.nextClaimAt
  }

  async refresh(): Promise<void> {
    if (!this.ledger) return
    this.profile = await this.ledger.readPlayer(this.identity.id)
  }

  /** Register (or rename) with the ledger and load the profile. */
  async init(): Promise<void> {
    if (!this.ledger) return
    await this.ledger.hello(this.identity, loadPlayerName(APP) || 'Guest')
    await this.refresh()
  }

  async claim(): Promise<void> {
    if (!this.ledger || !this.canClaim) return
    this.busy = true
    try {
      const reply = await this.ledger.claimDaily(this.identity)
      if (!reply.ok) {
        this.notice = reply.error ?? 'Claim failed.'
        return
      }
      if (reply.nextClaimAt) {
        this.nextClaimAt = reply.nextClaimAt
        localStorage.setItem(NEXT_CLAIM_KEY, String(reply.nextClaimAt))
      }
      this.notice = reply.status === 'claimed' ? `+${DAILY_CASH.toLocaleString()} collected` : 'Already collected today'
      await this.refresh()
    } finally {
      this.busy = false
    }
  }
}

export const wallet = new WalletStore()
