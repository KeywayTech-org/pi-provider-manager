import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ProviderEditor } from "@/components/provider-editor";
import { Toaster } from "@/components/ui/sonner";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
	getConfig,
	saveConfig,
	type Provider,
	type Settings,
} from "@/lib/api";
import { toast } from "sonner";

export default function App() {
	const [providers, setProviders] = useState<Record<string, Provider>>({});
	const [settings, setSettings] = useState<Settings>({});
	const [selected, setSelected] = useState<string | null>(null);
	const [loaded, setLoaded] = useState(false);
	const [addOpen, setAddOpen] = useState(false);
	const [addName, setAddName] = useState("");
	const [delTarget, setDelTarget] = useState<string | null>(null);

	useEffect(() => {
		load();
	}, []);

	async function load() {
		try {
			const c = await getConfig();
			setProviders(c.providers);
			setSettings(c.settings);
			const names = Object.keys(c.providers);
			setSelected((prev) => (prev && names.includes(prev) ? prev : names[0] || null));
		} catch (e) {
			toast.error("加载失败: " + String((e as Error)?.message || e));
		} finally {
			setLoaded(true);
		}
	}

	function persist(next: Record<string, Provider>, s: Settings) {
		return saveConfig({ providers: next, settings: s })
			.then((j) => {
				if (j.ok) {
					toast.success("已保存（已自动备份），打开 /model 或重启 pi 生效");
					return true;
				}
				toast.error(j.error || "保存失败");
				return false;
			})
			.catch((e) => {
				toast.error("保存失败: " + String((e as Error)?.message || e));
				return false;
			});
	}

	function handleSaveProvider(edited: Provider) {
		if (!selected) return;
		const next = { ...providers, [selected]: edited };
		setProviders(next);
		persist(next, settings);
	}
	function handleSaveDefaults() {
		persist(providers, settings);
	}
	function handleAdd() {
		const name = addName.trim();
		if (!name) {
			toast.error("请输入 ID");
			return;
		}
		if (providers[name]) {
			toast.error("ID 已存在");
			return;
		}
		const next = {
			...providers,
			[name]: { baseUrl: "", api: "openai-completions", apiKey: "", models: [] },
		};
		setProviders(next);
		setSelected(name);
		setAddOpen(false);
		setAddName("");
		toast.success("已创建，填好后点「保存供应商」");
	}
	function handleDelete() {
		if (!delTarget) return;
		const next = { ...providers };
		delete next[delTarget];
		setProviders(next);
		if (selected === delTarget) setSelected(Object.keys(next)[0] || null);
		setDelTarget(null);
		persist(next, settings);
	}
	return (
		<>
			<AppShell
				sidebar={
					<AppSidebar
						providers={providers}
						selected={selected}
						onSelect={setSelected}
						onAdd={() => {
							setAddName("");
							setAddOpen(true);
						}}
						onDelete={setDelTarget}
						settings={settings}
						onChangeSettings={setSettings}
						onSaveSettings={handleSaveDefaults}
					/>
				}
				header={<AppHeader title={selected || "供应商管理"} />}
			>
				{!loaded ? (
					<div className="py-20 text-center text-sm text-muted-foreground">
						加载中…
					</div>
				) : selected && providers[selected] ? (
					<ProviderEditor
						key={selected}
						name={selected}
						provider={providers[selected]}
						onSave={handleSaveProvider}
					/>
				) : (
					<div className="flex flex-1 items-center justify-center">
						<Card className="max-w-sm">
							<CardContent className="py-10 text-center">
								<p className="text-sm font-medium">从左侧选择或新增一个供应商</p>
								<p className="mt-1 text-xs text-muted-foreground">
									配置写入 ~/.pi/agent/models.json，保存后打开 /model 即生效
								</p>
								<Button
									className="mt-4"
									onClick={() => {
										setAddName("");
										setAddOpen(true);
									}}
								>
									+ 新增供应商
								</Button>
							</CardContent>
						</Card>
					</div>
				)}
			</AppShell>

			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>新增供应商</DialogTitle>
						<DialogDescription>
							ID 将作为 models.json 的键，例如 deepseek、b-ai。
						</DialogDescription>
					</DialogHeader>
					<Input
						autoFocus
						value={addName}
						onChange={(e) => setAddName(e.target.value)}
						placeholder="供应商 ID"
						onKeyDown={(e) => e.key === "Enter" && handleAdd()}
					/>
					<DialogFooter>
						<Button onClick={handleAdd}>创建</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>删除供应商</DialogTitle>
						<DialogDescription>
							将删除 {delTarget} 并写入 models.json（会先自动备份）。此操作不可在页面内撤销。
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDelTarget(null)}>
							取消
						</Button>
						<Button variant="destructive" onClick={handleDelete}>
							删除
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Toaster />
		</>
	);
}
