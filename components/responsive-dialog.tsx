import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";

interface ResponsiveDialogProps {
    title: string;
    description: string;
    children: React.ReactNode;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    contentClassName?: string;
    bodyClassName?: string;
};

export const ResponsiveDialog = ({
    title,
    description,
    children,
    open,
    onOpenChange,
    contentClassName,
    bodyClassName,
}: ResponsiveDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={cn("flex max-h-[90vh] flex-col sm:max-w-lg", contentClassName)}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className={cn("min-h-0 overflow-y-auto", bodyClassName)}>
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
};
