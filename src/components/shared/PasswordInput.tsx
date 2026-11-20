import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  withLockIcon?: boolean
}

export function PasswordInput({
  className,
  withLockIcon = false,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      {withLockIcon && (
        <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5 pointer-events-none" />
      )}
      <Input
        {...props}
        type={visible ? 'text' : 'password'}
        className={cn(withLockIcon ? 'pl-9 pr-10' : 'pr-10', className)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={visible ? 'Ocultar senha' : 'Ver senha'}
        title={visible ? 'Ocultar senha' : 'Ver senha'}
        onClick={() => setVisible((v) => !v)}
        className="absolute right-1 top-1 h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
    </div>
  )
}
