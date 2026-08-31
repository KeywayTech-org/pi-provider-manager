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
		<div className="overflow-hidden">
			<SidebarProvider className="relative mx-auto h-svh w-full max-w-6xl lg:border-x">
				<FullWidthDivider className="top-14 z-60 -translate-y-px" />
				{sidebar}
				<SidebarInset>
					{header}
					<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 md:p-6">
						{children}
					</div>
				</SidebarInset>
			</SidebarProvider>
		</div>
	);
}
