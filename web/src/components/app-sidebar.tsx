"use client";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Plus, ServerIcon, X } from "lucide-react";
import { THINKING_LEVELS, type Provider, type Settings } from "@/lib/api";

const NONE = "__none__";

export function AppSidebar({
	providers,
	selected,
	onSelect,
	onAdd,
	onDelete,
	settings,
	onChangeSettings,
	onSaveSettings,
}: {
	providers: Record<string, Provider>;
	selected: string | null;
	onSelect: (name: string) => void;
	onAdd: () => void;
	onDelete: (name: string) => void;
	settings: Settings;
	onChangeSettings: (s: Settings) => void;
	onSaveSettings: () => void;
}) {
	const providerNames = Object.keys(providers);

	return (
		<Sidebar
			className="static h-screen *:data-[slot=sidebar-inner]:bg-background"
			collapsible="offcanvas"
			variant="sidebar"
		>
			<SidebarHeader className="relative h-14 items-center justify-center px-3"><span className="text-sm font-medium">Provider Manager</span></SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel className="flex items-center justify-between pr-1">
						<span className="font-normal">供应商</span>
						<Button size="sm" variant="outline" className="h-6 gap-1 px-2" onClick={onAdd}>
							<Plus className="size-3.5" />
							新增
						</Button>
					</SidebarGroupLabel>
					<SidebarMenu className="gap-0.5">
						{providerNames.length === 0 && (
							<SidebarMenuItem>
								<p className="px-3 py-2 text-sm text-muted-foreground">暂无供应商</p>
							</SidebarMenuItem>
						)}
						{providerNames.map((name) => {
							const p = providers[name] || {};
							const active = name === selected;
							return (
								<SidebarMenuItem key={name}>
									<div
										role="button"
										tabIndex={0}
										onClick={() => onSelect(name)}
										onKeyDown={(e) => e.key === "Enter" && onSelect(name)}
										className={cn(
											"group flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
											active
												? "bg-accent text-accent-foreground"
												: "hover:bg-accent/50"
										)}
									>
										<ServerIcon className="size-4 shrink-0" />
										<span className="flex-1 truncate text-left">{name}</span>
										<span className="text-xs text-muted-foreground">
											{Array.isArray(p.models) ? p.models.length : 0}
										</span>
										<button
											aria-label={"删除 " + name}
											onClick={(e) => {
												e.stopPropagation();
												onDelete(name);
											}}
											className="hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:block"
											type="button"
										>
											<X className="size-3.5" />
										</button>
									</div>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter className="gap-3 p-3">
				<div className="space-y-3 border-t pt-3">
					<div className="space-y-1">
						<Label className="text-xs">默认供应商</Label>
						<Select
							value={settings.defaultProvider || NONE}
							onValueChange={(v) =>
								onChangeSettings({
									...settings,
									defaultProvider: v === NONE ? undefined : v,
								})
							}
						>
							<SelectTrigger className="h-8">
								<SelectValue placeholder="（无）" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>（无）</SelectItem>
								{providerNames.map((n) => (
									<SelectItem key={n} value={n}>
										{n}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">默认模型</Label>
						<Input
							className="h-8"
							value={settings.defaultModel || ""}
							onChange={(e) =>
								onChangeSettings({
									...settings,
									defaultModel: e.target.value || undefined,
								})
							}
							placeholder="deepseek-v4-flash-vision-exp"
						/>
					</div>
					<div className="space-y-1">
						<Label className="text-xs">思考级别</Label>
						<Select
							value={settings.defaultThinkingLevel || NONE}
							onValueChange={(v) =>
								onChangeSettings({
									...settings,
									defaultThinkingLevel: v === NONE ? undefined : v,
								})
							}
						>
							<SelectTrigger className="h-8">
								<SelectValue placeholder="（不设置）" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={NONE}>（不设置）</SelectItem>
								{THINKING_LEVELS.map((l) => (
									<SelectItem key={l} value={l}>
										{l}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
					<Button className="w-full" size="sm" variant="outline" onClick={onSaveSettings}>
						保存默认设置
					</Button>
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
