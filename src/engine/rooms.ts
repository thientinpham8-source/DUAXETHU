import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, type User } from 'firebase/auth'
import {
  collection, doc, getFirestore, limit, onSnapshot, query, runTransaction, serverTimestamp,
  setDoc, updateDoc, where, type Unsubscribe,
} from 'firebase/firestore'
import type { TrackTheme } from '../game/config'
import type { RemoteKartPose } from '../game/game'

// Firebase Web config is public app metadata. Access is restricted by Authentication and Rules.
const app = initializeApp({
  apiKey: 'AIzaSyC9sm8iN-K4-bPtE29X_0ivXX4Di_i8l30',
  authDomain: 'duaxethu.firebaseapp.com',
  projectId: 'duaxethu',
  storageBucket: 'duaxethu.firebasestorage.app',
  messagingSenderId: '1083065068364',
  appId: '1:1083065068364:web:704223ddadcf12db943de9',
})

export type RoomMember = { uid: string; name: string; character: string; host: boolean; ready: boolean; selected: boolean }
export type RoomPose = RemoteKartPose & { uid: string }
export type PublicRoom = { code: string; hostName: string; count: number; track: TrackTheme }
export type RoomView = { code: string; hostUid: string; track: TrackTheme; phase: 'waiting' | 'selecting' | 'racing'; members: RoomMember[] }
export type RoomState = { user?: User; rooms: PublicRoom[]; current?: RoomView; busy: boolean; error?: string }

const db = getFirestore(app)
const auth = getAuth(app)
const roomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')
const safeName = (name: string) => name.trim().replace(/[<>]/g, '').slice(0, 16) || 'PLAYER'

export class RoomService {
  state: RoomState = { rooms: [], busy: true }
  private readonly listeners = new Set<(state: RoomState) => void>()
  private roomsOff?: Unsubscribe
  private roomOff?: Unsubscribe
  private membersOff?: Unsubscribe
  private posesOff?: Unsubscribe
  private currentCode?: string
  private poseListeners = new Set<(poses: RoomPose[]) => void>()
  private publishingPose = false

  constructor() {
    void this.initialize()
  }

  dispose(): void {
    this.roomsOff?.()
    this.roomsOff = undefined
    this.stopRoomWatch()
    this.poseListeners.clear()
    this.listeners.clear()
  }

  subscribe(listener: (state: RoomState) => void): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => this.listeners.delete(listener)
  }

  subscribePoses(listener: (poses: RoomPose[]) => void): () => void {
    this.poseListeners.add(listener)
    return () => this.poseListeners.delete(listener)
  }

  async publishPose(pose: RemoteKartPose): Promise<void> {
    const user = this.state.user
    const code = this.currentCode
    if (!user || !code || this.state.current?.phase !== 'racing' || this.publishingPose) return
    this.publishingPose = true
    try {
      await setDoc(doc(db, 'rooms', code, 'poses', user.uid), { ...pose, updatedAt: serverTimestamp() }, { merge: true })
    } finally {
      this.publishingPose = false
    }
  }

  private update(patch: Partial<RoomState>): void {
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener(this.state)
  }

  private async initialize(): Promise<void> {
    try {
      const credential = auth.currentUser ? { user: auth.currentUser } : await signInAnonymously(auth).then(user => ({ user: user.user }))
      this.update({ user: credential.user, busy: false })
      this.roomsOff = onSnapshot(query(collection(db, 'rooms'), where('status', '==', 'waiting'), limit(30)), snapshot => {
        const rooms = snapshot.docs.map(item => {
          const data = item.data()
          return { code: item.id, hostName: String(data.hostName ?? 'PLAYER'), count: Number(data.memberCount ?? 1), track: data.track === 'halloween' ? 'halloween' : 'candy' } as PublicRoom
        })
        this.update({ rooms })
      }, error => this.update({ error: this.describe(error) }))
    } catch (error) {
      this.update({ busy: false, error: this.describe(error) })
    }
  }

  async create(name: string, character: string, track: TrackTheme): Promise<void> {
    await this.withBusy(async () => {
      const user = await this.requireUser()
      const code = roomCode()
      const roomRef = doc(db, 'rooms', code)
      const memberRef = doc(roomRef, 'members', user.uid)
      await runTransaction(db, async tx => {
        if ((await tx.get(roomRef)).exists()) throw new Error('Mã phòng vừa được sử dụng. Hãy tạo lại phòng.')
        tx.set(roomRef, { code, hostUid: user.uid, hostName: safeName(name), status: 'waiting', track, memberCount: 1, createdAt: serverTimestamp() })
        tx.set(memberRef, { uid: user.uid, name: safeName(name), character, host: true, ready: false, selected: false, joinedAt: serverTimestamp() })
      })
      this.watchRoom(code)
    })
  }

  async join(codeInput: string, name: string, character: string): Promise<void> {
    await this.withBusy(async () => {
      const user = await this.requireUser()
      const code = codeInput.trim().toUpperCase()
      if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Error('Mã phòng phải gồm 6 chữ cái hoặc số (không có O, I, 0, 1).')
      const roomRef = doc(db, 'rooms', code)
      const memberRef = doc(roomRef, 'members', user.uid)
      await runTransaction(db, async tx => {
        const room = await tx.get(roomRef)
        if (!room.exists() || room.data().status !== 'waiting') throw new Error('Không tìm thấy phòng đang chờ.')
        const members = await tx.get(memberRef)
        if (!members.exists() && Number(room.data().memberCount ?? 0) >= 6) throw new Error('Phòng đã đủ 6 người.')
        tx.set(memberRef, { uid: user.uid, name: safeName(name), character, host: false, ready: false, selected: false, joinedAt: serverTimestamp() })
        if (!members.exists()) tx.update(roomRef, { memberCount: Number(room.data().memberCount ?? 0) + 1 })
      })
      this.watchRoom(code)
    })
  }

  async leave(): Promise<void> {
    const user = this.state.user
    const code = this.currentCode
    this.stopRoomWatch()
    this.update({ current: undefined })
    if (!user || !code) return
    try {
      const roomRef = doc(db, 'rooms', code)
      const memberRef = doc(roomRef, 'members', user.uid)
      const poseRef = doc(roomRef, 'poses', user.uid)
      await runTransaction(db, async tx => {
        const [room, member] = await Promise.all([tx.get(roomRef), tx.get(memberRef)])
        if (!room.exists() || !member.exists()) return
        const count = Math.max(0, Number(room.data().memberCount ?? 1) - 1)
        tx.delete(memberRef)
        tx.delete(poseRef)
        if (room.data().hostUid === user.uid || count === 0) tx.delete(roomRef)
        else tx.update(roomRef, { memberCount: count })
      })
    } catch (error) {
      this.update({ error: this.describe(error) })
    }
  }

  async setReady(ready: boolean): Promise<void> {
    const user = await this.requireUser()
    const code = this.currentCode
    if (!code || this.state.current?.phase !== 'waiting') return
    await this.withBusy(() => updateDoc(doc(db, 'rooms', code, 'members', user.uid), { ready }))
  }

  async startSelection(): Promise<void> {
    const room = this.state.current
    if (!room || room.hostUid !== this.state.user?.uid || room.phase !== 'waiting' || !room.members.length || room.members.some(member => !member.ready)) return
    await this.withBusy(() => updateDoc(doc(db, 'rooms', room.code), { status: 'selecting' }))
  }

  async selectCharacter(character: string): Promise<void> {
    const user = await this.requireUser()
    const code = this.currentCode
    if (!code || this.state.current?.phase !== 'selecting') return
    await this.withBusy(() => updateDoc(doc(db, 'rooms', code, 'members', user.uid), { character, selected: true }))
  }

  async startRace(): Promise<void> {
    const room = this.state.current
    if (!room || room.hostUid !== this.state.user?.uid || room.phase !== 'selecting' || !room.members.length || room.members.some(member => !member.selected)) return
    await this.withBusy(() => updateDoc(doc(db, 'rooms', room.code), { status: 'racing' }))
  }

  private watchRoom(code: string): void {
    this.stopRoomWatch()
    this.currentCode = code
    const roomRef = doc(db, 'rooms', code)
    this.roomOff = onSnapshot(roomRef, snapshot => {
      if (!snapshot.exists()) {
        this.stopRoomWatch()
        this.update({ current: undefined, error: 'Phòng đã đóng.' })
        return
      }
      const data = snapshot.data()
      this.update({ current: { code, hostUid: String(data.hostUid), track: data.track === 'halloween' ? 'halloween' : 'candy', phase: data.status === 'selecting' || data.status === 'racing' ? data.status : 'waiting', members: this.state.current?.code === code ? this.state.current.members : [] } })
    }, error => this.update({ error: this.describe(error) }))
    this.membersOff = onSnapshot(collection(roomRef, 'members'), snapshot => {
      const members = snapshot.docs.map(item => ({ uid: item.id, name: String(item.data().name ?? 'PLAYER'), character: String(item.data().character ?? 'bunny'), host: item.data().host === true, ready: item.data().ready === true, selected: item.data().selected === true })).sort((a, b) => a.uid.localeCompare(b.uid))
      if (this.state.current?.code === code) this.update({ current: { ...this.state.current, members } })
    }, error => this.update({ error: this.describe(error) }))
    this.posesOff = onSnapshot(collection(roomRef, 'poses'), snapshot => {
      const poses = snapshot.docs.map(item => {
        const data = item.data()
        return { uid: item.id, x: Number(data.x), y: Number(data.y), z: Number(data.z), yaw: Number(data.yaw), speed: Number(data.speed) }
      }).filter(pose => [pose.x, pose.y, pose.z, pose.yaw, pose.speed].every(Number.isFinite))
      for (const listener of this.poseListeners) listener(poses)
    }, error => this.update({ error: this.describe(error) }))
  }

  private stopRoomWatch(): void {
    this.roomOff?.(); this.roomOff = undefined
    this.membersOff?.(); this.membersOff = undefined
    this.posesOff?.(); this.posesOff = undefined
    this.currentCode = undefined
  }

  private async requireUser(): Promise<User> {
    if (this.state.user) return this.state.user
    if (auth.currentUser) return auth.currentUser
    const result = await signInAnonymously(auth)
    this.update({ user: result.user })
    return result.user
  }

  private async withBusy(run: () => Promise<void>): Promise<void> {
    this.update({ busy: true, error: undefined })
    try { await run() } catch (error) { this.update({ error: this.describe(error) }) }
    finally { this.update({ busy: false }) }
  }

  private describe(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('permission-denied')) return 'Firebase từ chối truy cập. Cần cập nhật Firestore Rules cho phòng chơi.'
    if (message.includes('unavailable')) return 'Không kết nối được Firebase. Kiểm tra mạng rồi thử lại.'
    return message
  }
}
