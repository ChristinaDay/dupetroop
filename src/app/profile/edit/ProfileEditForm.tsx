'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ImageUpload } from '@/components/ui/ImageUpload'
import { updateProfile } from '@/lib/actions/profile.actions'
import { toast } from 'sonner'
import type { Profile } from '@/lib/types/app.types'

export function ProfileEditForm({ profile, userId }: { profile: Profile; userId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [displayName, setDisplayName] = useState(profile.display_name ?? '')
  const [username, setUsername] = useState(profile.username ?? '')
  const [bio, setBio] = useState(profile.bio ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null)

  const initials = (displayName || username || '?').slice(0, 2).toUpperCase()

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await updateProfile({ displayName, username, bio, avatarUrl })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Profile updated.')
        router.push('/profile')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="space-y-2">
        <Label>Profile photo</Label>
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="text-xl font-black">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <ImageUpload
              value={avatarUrl}
              onChange={setAvatarUrl}
              userId={userId}
              bucket="avatars"
            />
          </div>
        </div>
      </div>

      {/* Display name */}
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Your name"
          maxLength={60}
        />
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <Label htmlFor="username">
          Username <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
          <Input
            id="username"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            placeholder="yourname"
            maxLength={30}
            className="pl-7 font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground">3–30 characters: letters, numbers, underscores.</p>
      </div>

      {/* Bio */}
      <div className="space-y-1.5">
        <Label htmlFor="bio">
          Bio <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={e => setBio(e.target.value)}
          placeholder="Say something about yourself…"
          rows={3}
          maxLength={300}
        />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/300</p>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push('/profile')}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={isPending || !username.trim()}
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </div>
  )
}
