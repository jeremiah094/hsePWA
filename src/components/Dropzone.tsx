import { useCallback, useRef, useState } from 'react'

interface DropzoneProps {
  onFiles: (files: File[]) => void
  busy?: boolean
}

export default function Dropzone({ onFiles, busy }: DropzoneProps) {
  const [dragActive, setDragActive] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return
      onFiles(Array.from(fileList))
    },
    [onFiles],
  )

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragActive(false)
        handleFiles(e.dataTransfer.files)
      }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
        dragActive ? 'border-ink bg-slate-100' : 'border-slate-300 bg-white'
      } ${busy ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.pdf,text/csv,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-slate-700 font-medium">
        {busy ? 'Processing statements…' : 'Drop bank statements here, or click to choose files'}
      </p>
      <p className="text-slate-400 text-sm mt-1">CSV exports work best. PDF is best-effort.</p>
    </div>
  )
}
