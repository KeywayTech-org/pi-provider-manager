import { SidebarTrigger } from "@/components/ui/sidebar";

export function AppHeader() {
	return (
		<header className="sticky top-0 z-50 flex h-14 shrink-0 items-center bg-background px-4 md:hidden">
			<SidebarTrigger />
		</header>
	);
}