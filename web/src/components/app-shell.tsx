import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { FullWidthDivider } from "@/components/full-width-divider";

export function AppShell({
	sidebar,
	header,
	children,
}: {
	sidebar: React.ReactNode;
	header: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="h-dvh overflow-hidden">
			<SidebarProvider className="relative mx-auto h-dvh w-full max-w-6xl overflow-hidden lg:border-x">
				<FullWidthDivider className="top-14 z-60 -translate-y-px md:hidden" />
				{sidebar}
				<SidebarInset className="min-h-0 rounded-none">
					{header}
					<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:p-6">
						{children}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
