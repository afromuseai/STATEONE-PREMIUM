import { Toaster as Sonner, ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "!bg-background/95 !border-border/60 !text-foreground !backdrop-blur-xl",
          title: "!text-foreground !font-semibold",
          description: "!text-muted-foreground",
          success: "!border-green-500/30",
          error: "!border-red-500/30",
          warning: "!border-yellow-500/30",
          info: "!border-blue-500/30",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
