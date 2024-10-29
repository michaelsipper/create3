import toast from 'react-hot-toast'

export { toast }
export const useToast = () => {
  return {
    toast,
    dismiss: toast.dismiss
  }
}