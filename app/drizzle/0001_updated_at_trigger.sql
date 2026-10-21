-- Keeps updated_at current on every update, so code cannot forget it. Shared by every area's tables.
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
	NEW.updated_at = now();
	RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON auth.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
