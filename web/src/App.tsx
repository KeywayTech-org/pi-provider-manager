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
import { useI18n } from "@/i18n";

export default function App() {
	const { t } = useI18n();
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
			toast.error(t("app.loadFailed", { message: String((e as Error)?.message || e) }));
		} finally {
			setLoaded(true);
		}
	}

	function persist(next: Record<string, Provider>, s: Settings) {
		return saveConfig({ providers: next, settings: s })
			.then((j) => {
				if (j.ok) {
					toast.success(t("app.saved"));
					return true;
				}
				toast.error(j.error || t("app.saveFailed"));
				return false;
			})
			.catch((e) => {
				toast.error(t("app.saveFailedWith", { message: String((e as Error)?.message || e) }));
				return false;
			});
	}

	function handleSaveProvider(edited: Provider) {
		if (!selected) return;
		const next = { ...providers, [selected]: edited };
		setProviders(next);
		persist(next, settings);
	}
	function handleAdd() {
		const name = addName.trim();
		if (!name) {
			toast.error(t("app.addIdRequired"));
			return;
		}
		if (providers[name]) {
			toast.error(t("app.addIdExists"));
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
		toast.success(t("app.addCreated"));
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
					/>
				}
				header={<AppHeader />}
			>
				{!loaded ? (
					<div className="py-20 text-center text-sm text-muted-foreground">
						{t("common.loading")}
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
								<p className="text-sm font-medium">{t("app.emptyTitle")}</p>
								<p className="mt-1 text-xs text-muted-foreground">{t("app.emptyHint")}</p>
								<Button
									className="mt-4"
									onClick={() => {
										setAddName("");
										setAddOpen(true);
									}}
								>
									+ {t("app.emptyAdd")}
								</Button>
							</CardContent>
						</Card>
					</div>
				)}
			</AppShell>

			<Dialog open={addOpen} onOpenChange={setAddOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>{t("app.addTitle")}</DialogTitle>
						<DialogDescription>{t("app.addDescription")}</DialogDescription>
					</DialogHeader>
					<Input
						autoFocus
						value={addName}
						onChange={(e) => setAddName(e.target.value)}
						placeholder={t("app.addIdPlaceholder")}
						onKeyDown={(e) => e.key === "Enter" && handleAdd()}
					/>
					<DialogFooter>
						<Button onClick={handleAdd}>{t("app.addCreate")}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>{t("app.deleteTitle")}</DialogTitle>
						<DialogDescription>
							{t("app.deleteDescription", { name: delTarget ?? "" })}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDelTarget(null)}>
							{t("common.cancel")}
						</Button>
						<Button variant="destructive" onClick={handleDelete}>
							{t("common.delete")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Toaster />
		</>
	);
}
