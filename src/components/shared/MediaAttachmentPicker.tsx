import { useCallback, useEffect, useRef, useState } from 'react'
import { buildSafeImageFileName, validateImageFile } from '@/lib/fileValidation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Camera, CheckCircle2, FileImage, RefreshCw, Sparkles, UploadCloud, VideoOff, X } from 'lucide-react'
import { toast } from 'sonner'

export interface CapturedMediaFile {
  file: File
  previewUrl: string
  caption: string
}

interface MediaAttachmentPickerProps {
  triggerLabel?: string
  title?: string
  description?: string
  accept?: string
  onConfirmUpload: (media: CapturedMediaFile) => Promise<void>
  triggerVariant?: 'default' | 'outline' | 'secondary'
}

export function MediaAttachmentPicker({
  triggerLabel = 'Anexar Foto ou Câmera',
  title = 'Adicionar Anexo Visual ou Captura de Câmera',
  description = 'Selecione uma imagem do dispositivo (arraste e solte) ou tire uma foto agora usando a câmera.',
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  onConfirmUpload,
  triggerVariant = 'outline',
}: MediaAttachmentPickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'upload' | 'camera'>('upload')
  const [dragActive, setDragActive] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)

  // Camera state
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    setCameraReady(false)
  }, [])

  const startCamera = useCallback(async () => {
    stopCamera()
    setCameraError(null)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('Seu navegador não disponibiliza acesso direto à câmera neste ambiente.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => null)
      }
      setCameraReady(true)
    } catch (err: any) {
      setCameraError(
        'Não foi possível acessar a câmera (verifique a permissão do navegador ou utilize a aba de envio de arquivo).',
      )
    }
  }, [facingMode, stopCamera])

  useEffect(() => {
    if (open && tab === 'camera' && !selectedFile) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [open, tab, selectedFile, startCamera, stopCamera])

  const handleFileChosen = async (file: File | undefined | null) => {
    if (!file) return
    const check = await validateImageFile(file)
    if (!check.ok) {
      toast.error(check.error)
      return
    }
    const safeName = buildSafeImageFileName(file.name, check.ext)
    const cleanFile = new File([file], safeName, { type: check.mime })
    setSelectedFile(cleanFile)
    const url = URL.createObjectURL(cleanFile)
    setPreviewUrl(url)
    if (!caption) {
      setCaption(safeName.replace(/\.[^.]+$/, ''))
    }
  }

  const handleTakeSnapshot = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 960
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], `captura-mylabs-${Date.now()}.jpg`, { type: 'image/jpeg' })
        handleFileChosen(file)
        stopCamera()
      },
      'image/jpeg',
      0.9,
    )
  }

  const handleResetSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSelectedFile(null)
    setPreviewUrl('')
  }

  const handleSave = async () => {
    if (!selectedFile) {
      toast.error('Selecione ou capture uma imagem primeiro.')
      return
    }
    setUploading(true)
    try {
      await onConfirmUpload({
        file: selectedFile,
        previewUrl,
        caption: caption.trim() || selectedFile.name,
      })
      handleResetSelection()
      setCaption('')
      setOpen(false)
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao enviar anexo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          stopCamera()
          handleResetSelection()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant={triggerVariant} size="sm" className="gap-2">
          <Camera className="w-4 h-4 text-emerald-600" />
          <span>{triggerLabel}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 text-white">Mídia Clínica MyLabs</Badge>
            <Badge variant="outline">Até 10 MB</Badge>
          </div>
          <DialogTitle className="font-display text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            handleResetSelection()
            setTab(v as 'upload' | 'camera')
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="gap-2">
              <UploadCloud className="w-4 h-4" />
              <span>Enviar Foto / Arquivo</span>
            </TabsTrigger>
            <TabsTrigger value="camera" className="gap-2">
              <Camera className="w-4 h-4" />
              <span>Usar Câmera ao Vivo</span>
            </TabsTrigger>
          </TabsList>

          {/* ABA 1: DRAG & DROP FILE PICKER */}
          <TabsContent value="upload" className="mt-4 space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => handleFileChosen(e.target.files?.[0])}
            />

            {!selectedFile ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                  handleFileChosen(e.dataTransfer.files?.[0])
                }}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                }}
                className={`rounded-2xl border-2 border-dashed p-7 text-center transition-all flex flex-col items-center justify-center gap-3 ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50/70'
                    : 'border-border bg-muted/30 hover:border-emerald-400 hover:bg-emerald-50/30'
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                  <FileImage className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-foreground">
                    Clique para selecionar ou arraste a imagem aqui
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Formatos aceitos: JPG, PNG, WEBP ou GIF • Qualidade clínica preservada
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Badge variant="secondary" className="gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-600" />
                    Foto de Prato / Porção
                  </Badge>
                  <Badge variant="secondary">Rótulo Nutricional</Badge>
                  <Badge variant="secondary">Guia Visual</Badge>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-slate-950/5 h-52 flex items-center justify-center">
                  <img src={previewUrl} alt="Pré-visualização" className="max-h-52 w-auto object-contain" />
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    onClick={handleResetSelection}
                    className="absolute top-2 right-2 h-8 w-8 rounded-xl"
                    title="Trocar imagem"
                    aria-label="Remover imagem selecionada"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="font-medium truncate max-w-[240px]">{selectedFile.name}</span>
                  <Badge variant="outline">{(selectedFile.size / 1024).toFixed(0)} KB</Badge>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ABA 2: CÂMERA AO VIVO */}
          <TabsContent value="camera" className="mt-4 space-y-4">
            {!selectedFile ? (
              <div className="rounded-2xl border border-border bg-slate-950 overflow-hidden relative min-h-[240px] flex flex-col items-center justify-center">
                {cameraError ? (
                  <div className="p-6 text-center space-y-3 max-w-sm">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto">
                      <VideoOff className="w-5 h-5" />
                    </div>
                    <Alert className="bg-slate-900 border-slate-800 text-slate-200 text-left">
                      <AlertDescription className="text-xs leading-relaxed">{cameraError}</AlertDescription>
                    </Alert>
                    <div className="flex items-center justify-center gap-2">
                      <Button type="button" size="sm" variant="secondary" onClick={startCamera} className="gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" />
                        Tentar Novamente
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          setTab('upload')
                          setTimeout(() => fileInputRef.current?.click(), 50)
                        }}
                      >
                        Escolher Foto do Dispositivo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="w-full h-60 object-cover bg-slate-950"
                    />
                    <div className="w-full p-3 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                        }
                        className="gap-1.5 text-xs"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Alternar Câmera
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!cameraReady}
                        onClick={handleTakeSnapshot}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        Capturar Foto Agora
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-slate-950/5 h-52 flex items-center justify-center">
                  <img src={previewUrl} alt="Foto capturada" className="max-h-52 w-auto object-contain" />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleResetSelection}
                    className="absolute top-2 right-2 gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tirar Outra
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="space-y-2 pt-1">
          <Label htmlFor="attachment-caption">Legenda ou Orientação da Foto</Label>
          <Input
            id="attachment-caption"
            placeholder="Ex: Montagem padrão do prato no almoço (180g frango + vegetais)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2 pt-3">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!selectedFile || uploading}
            onClick={handleSave}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{uploading ? 'Enviando anexo...' : 'Confirmar e Anexar'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
