import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, LANGUAGE_LABELS, SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/hooks/useLanguage";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTranslation } from "react-i18next";
import { loadPageNamespace } from "@/i18n";
import {
  User,
  Bell,
  Lock,
  Palette,
  Save,
  Mail,
  Shield,
  Trash2,
  Sparkles,
  Smartphone,
  Globe,
  Eye,
  CheckCircle2,
} from "lucide-react";

interface UserSettings {
  fullName: string;
  email: string;
  bio: string;
  emailNotifications: boolean;
  pushNotifications: boolean;
  assignmentReminders: boolean;
  announcementAlerts: boolean;
  weeklyDigest: boolean;
  profileVisibility: "public" | "classmates" | "private";
}

const SETTINGS_KEY = "gc_user_settings";

const defaultSettings: UserSettings = {
  fullName: "",
  email: "",
  bio: "",
  emailNotifications: true,
  pushNotifications: true,
  assignmentReminders: true,
  announcementAlerts: true,
  weeklyDigest: false,
  profileVisibility: "classmates",
};

const loadSettings = (): UserSettings => {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return defaultSettings;
  }
};

const saveSettings = (s: UserSettings) => {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
};

export default function SettingsPage() {
  const { user, role, signOut } = useAuth();
  const { toast } = useToast();
  // `pages` namespace + `settings:` prefix → resolves to the
  // settings page's per-page bundle. `loaded: Set` inside the
  // loader makes this idempotent on remount.
  const { t } = useTranslation("pages");
  useEffect(() => {
    void loadPageNamespace("settings");
  }, []);

  // The top-bar `LanguageSwitcher` writes through the same hook, so
  // this dropdown is just a wider-form alternative view. Source of
  // truth is `localStorage["gc_user_settings"].language`; both views
  // re-read on the `gc-language-change` event.
  const { language, setLanguage } = useLanguage();
  const [settings, setSettings] = useState<UserSettings>(() => {
    const loaded = loadSettings();
    return {
      ...loaded,
      fullName: loaded.fullName || user?.name || "",
      email: loaded.email || user?.email || "",
    };
  });
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveSettings(settings);
      setSaving(false);
      toast({
        title: t("settings:toasts.saved"),
        description: t("settings:toasts.savedDescription"),
      });
    }, 500);
  };

  const handleReset = () => {
    setSettings({
      ...defaultSettings,
      fullName: user?.name || "",
      email: user?.email || "",
    });
    toast({ title: t("settings:toasts.reset") });
  };

  const handleDeleteAccount = () => {
    if (!confirm(t("settings:toasts.deleteConfirm"))) return;
    toast({
      title: t("settings:toasts.deleteRequested"),
      description: t("settings:toasts.deleteRequestedDescription"),
      variant: "destructive",
    });
  };

  const initials = (settings.fullName || user?.name || "U")
    .split(" ")
    .map((p) => p.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          title={t("settings:title")}
          description={t("settings:description")}
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReset}>
                {t("settings:reset")}
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full"
                  />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("settings:saveChanges")}
              </Button>
            </div>
          }
        />

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full max-w-2xl grid-cols-4">
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings:tabs.profile")}</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings:tabs.notifications")}</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings:tabs.appearance")}</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">{t("settings:tabs.security")}</span>
            </TabsTrigger>
          </TabsList>

          {/* ── PROFILE TAB ── */}
          <TabsContent value="profile" className="mt-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("settings:profile.infoTitle")}</CardTitle>
                  <CardDescription>
                    {t("settings:profile.infoDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-lg font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold">{settings.fullName || t("settings:profile.yourName")}</p>
                      <p className="text-xs text-muted-foreground">{settings.email}</p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="secondary" className="capitalize">
                          {role || "user"}
                        </Badge>
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t("settings:profile.active")}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">{t("settings:profile.fullName")}</Label>
                      <Input
                        id="fullName"
                        value={settings.fullName}
                        onChange={(e) => update("fullName", e.target.value)}
                        placeholder={t("settings:profile.fullNamePlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("settings:profile.email")}</Label>
                      <Input
                        id="email"
                        type="email"
                        value={settings.email}
                        onChange={(e) => update("email", e.target.value)}
                        placeholder={t("settings:profile.emailPlaceholder")}
                        disabled
                      />
                      <p className="text-[11px] text-muted-foreground">
                        {t("settings:profile.emailHelp")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">{t("settings:profile.bio")}</Label>
                    <textarea
                      id="bio"
                      value={settings.bio}
                      onChange={(e) => update("bio", e.target.value)}
                      placeholder={t("settings:profile.bioPlaceholder")}
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 resize-none"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Eye className="h-4 w-4 text-primary" /> {t("settings:profile.privacyTitle")}
                  </CardTitle>
                  <CardDescription>{t("settings:profile.privacyDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>{t("settings:profile.profileVisibility")}</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {(["public", "classmates", "private"] as const).map((v) => (
                        <motion.button
                          key={v}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => update("profileVisibility", v)}
                          className={`px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                            settings.profileVisibility === v
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <span className="capitalize">{v}</span>
                          <p className="text-[11px] text-muted-foreground mt-1 font-normal">
                            {v === "public" && t("settings:profile.visibilityPublic")}
                            {v === "classmates" && t("settings:profile.visibilityClassmates")}
                            {v === "private" && t("settings:profile.visibilityPrivate")}
                          </p>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ── NOTIFICATIONS TAB ── */}
          <TabsContent value="notifications" className="mt-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> {t("settings:notifications.emailTitle")}
                  </CardTitle>
                  <CardDescription>{t("settings:notifications.emailDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <SettingRow
                    icon={<Bell className="h-4 w-4" />}
                    title={t("settings:notifications.emailItem")}
                    description={t("settings:notifications.emailItemDesc")}
                    checked={settings.emailNotifications}
                    onChange={(v) => update("emailNotifications", v)}
                  />
                  <Separator />
                  <SettingRow
                    icon={<Sparkles className="h-4 w-4" />}
                    title={t("settings:notifications.assignmentReminders")}
                    description={t("settings:notifications.assignmentRemindersDesc")}
                    checked={settings.assignmentReminders}
                    onChange={(v) => update("assignmentReminders", v)}
                  />
                  <Separator />
                  <SettingRow
                    icon={<Bell className="h-4 w-4" />}
                    title={t("settings:notifications.announcementAlerts")}
                    description={t("settings:notifications.announcementAlertsDesc")}
                    checked={settings.announcementAlerts}
                    onChange={(v) => update("announcementAlerts", v)}
                  />
                  <Separator />
                  <SettingRow
                    icon={<Mail className="h-4 w-4" />}
                    title={t("settings:notifications.weeklyDigest")}
                    description={t("settings:notifications.weeklyDigestDesc")}
                    checked={settings.weeklyDigest}
                    onChange={(v) => update("weeklyDigest", v)}
                  />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-primary" /> {t("settings:notifications.pushTitle")}
                  </CardTitle>
                  <CardDescription>{t("settings:notifications.pushDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SettingRow
                    icon={<Bell className="h-4 w-4" />}
                    title={t("settings:notifications.browserPush")}
                    description={t("settings:notifications.browserPushDesc")}
                    checked={settings.pushNotifications}
                    onChange={(v) => update("pushNotifications", v)}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ── APPEARANCE TAB ── */}
          <TabsContent value="appearance" className="mt-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" /> {t("settings:appearance.themeTitle")}
                  </CardTitle>
                  <CardDescription>{t("settings:appearance.themeDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">{t("settings:appearance.themeMode")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("settings:appearance.themeModeDesc")}
                      </p>
                    </div>
                    <ThemeToggle />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" /> {t("settings:languageAndRegion")}
                  </CardTitle>
                  <CardDescription>{t("settings:languageRegionDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-w-sm">
                    <Label>{t("settings:language")}</Label>
                    <select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
                      className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
                    >
                      {SUPPORTED_LANGUAGES.map((code) => (
                        <option key={code} value={code}>
                          {LANGUAGE_LABELS[code]}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      {t("settings:languageHelp")}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* ── SECURITY TAB ── */}
          <TabsContent value="security" className="mt-6 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" /> {t("settings:security.passwordTitle")}
                  </CardTitle>
                  <CardDescription>{t("settings:security.passwordDescription")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-w-md">
                    <Label>{t("settings:security.currentPassword")}</Label>
                    <Input type="password" placeholder="••••••••" />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <Label>{t("settings:security.newPassword")}</Label>
                    <Input type="password" placeholder={t("settings:security.newPasswordPlaceholder")} />
                  </div>
                  <div className="space-y-2 max-w-md">
                    <Label>{t("settings:security.confirmNewPassword")}</Label>
                    <Input type="password" placeholder={t("settings:security.confirmNewPasswordPlaceholder")} />
                  </div>
                  <Button className="gap-2">
                    <Lock className="h-4 w-4" /> {t("settings:security.updatePassword")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("settings:security.sessionTitle")}</CardTitle>
                  <CardDescription>{t("settings:security.sessionDescription")}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await signOut();
                      toast({ title: t("settings:toasts.signedOut") });
                    }}
                    className="gap-2"
                  >
                    <Lock className="h-4 w-4" /> {t("settings:security.signOut")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="border-rose-200 dark:border-rose-900/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2 text-rose-600">
                    <Trash2 className="h-4 w-4" /> {t("settings:security.dangerTitle")}
                  </CardTitle>
                  <CardDescription>
                    {t("settings:security.dangerDescription")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteAccount}
                    className="gap-2"
                  >
                    <Trash2 className="h-4 w-4" /> {t("settings:security.deleteAccount")}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function SettingRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
