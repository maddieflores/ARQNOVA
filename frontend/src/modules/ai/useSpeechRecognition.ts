import { useCallback, useEffect, useRef, useState } from 'react'

export interface SpeechRecognitionHook {
  isSupported: boolean
  isListening: boolean
  errorMessage: string | null
  startListening: () => void
  stopListening: () => void
  clearError: () => void
}

interface SpeechRecognitionOptions {
  lang?: string
  continuous?: boolean
  interimResults?: boolean
  onResult?: (transcript: string, isFinal: boolean) => void
  onError?: (errorMessage: string) => void
}

// Interfaz para compatibilidad con Web Speech API
interface IWindowWithSpeech extends Window {
  SpeechRecognition?: any
  webkitSpeechRecognition?: any
}

export function useSpeechRecognition({
  lang = 'es-ES',
  continuous = false,
  interimResults = true,
  onResult,
  onError,
}: SpeechRecognitionOptions = {}): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)
  const isListeningRef = useRef(false)

  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as IWindowWithSpeech).SpeechRecognition ||
      (window as unknown as IWindowWithSpeech).webkitSpeechRecognition,
    )

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListeningRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignorar si ya estaba detenido
      }
    }
    isListeningRef.current = false
    setIsListening(false)
  }, [])

  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  const startListening = useCallback(() => {
    setErrorMessage(null)

    if (!isSupported) {
      const msg = 'Tu navegador no soporta reconocimiento de voz (Speech-to-Text). Te recomendamos Google Chrome o Microsoft Edge.'
      setErrorMessage(msg)
      onError?.(msg)
      return
    }

    if (isListeningRef.current) {
      stopListening()
      return
    }

    try {
      const SpeechRecognitionClass =
        (window as unknown as IWindowWithSpeech).SpeechRecognition ||
        (window as unknown as IWindowWithSpeech).webkitSpeechRecognition

      const recognition = new SpeechRecognitionClass()
      recognition.lang = lang
      recognition.continuous = continuous
      recognition.interimResults = interimResults
      recognition.maxAlternatives = 1

      recognition.onstart = () => {
        isListeningRef.current = true
        setIsListening(true)
        setErrorMessage(null)
      }

      recognition.onresult = (event: any) => {
        let fullTranscript = ''
        let isFinal = false

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i]
          fullTranscript += result[0].transcript
          if (result.isFinal) {
            isFinal = true
          }
        }

        if (fullTranscript.trim()) {
          onResult?.(fullTranscript, isFinal)
        }
      }

      recognition.onerror = (event: any) => {
        let message = 'Ocurrió un error en el reconocimiento de voz.'

        switch (event.error) {
          case 'not-allowed':
          case 'service-not-allowed':
            message = 'Permiso de micrófono denegado. Permite el acceso al micrófono en la barra de direcciones de tu navegador.'
            break
          case 'no-speech':
            message = 'No se detectó ninguna voz. Intenta hablar más cerca del micrófono.'
            break
          case 'audio-capture':
            message = 'No se encontró ningún micrófono disponible en tu dispositivo.'
            break
          case 'network':
            message = 'Error de conexión con el servicio de reconocimiento de voz.'
            break
          case 'aborted':
            // Abortado manualmente por el usuario, no mostramos error
            isListeningRef.current = false
            setIsListening(false)
            return
          default:
            message = `Error de reconocimiento de voz: ${event.error || 'desconocido'}.`
        }

        setErrorMessage(message)
        onError?.(message)
        isListeningRef.current = false
        setIsListening(false)
      }

      recognition.onend = () => {
        isListeningRef.current = false
        setIsListening(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch (err: any) {
      const msg = err?.message || 'No fue posible iniciar el micrófono.'
      setErrorMessage(msg)
      onError?.(msg)
      isListeningRef.current = false
      setIsListening(false)
    }
  }, [continuous, interimResults, isSupported, lang, onError, onResult, stopListening])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // Ignorar error al limpiar
        }
      }
    }
  }, [])

  return {
    isSupported,
    isListening,
    errorMessage,
    startListening,
    stopListening,
    clearError,
  }
}
