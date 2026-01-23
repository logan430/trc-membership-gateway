-- Create function to update denormalized totalPoints (DB-07)
CREATE OR REPLACE FUNCTION update_member_total_points()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE "Member"
  SET
    "totalPoints" = "totalPoints" + NEW.points,
    "lastActiveAt" = CASE
      WHEN NEW.points > 0 THEN NOW()
      ELSE "lastActiveAt"
    END,
    "updatedAt" = NOW()
  WHERE id = NEW."memberId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that fires after every PointTransaction insert
CREATE TRIGGER trg_update_member_points
  AFTER INSERT ON "PointTransaction"
  FOR EACH ROW
  EXECUTE FUNCTION update_member_total_points();

-- Add comment for documentation
COMMENT ON FUNCTION update_member_total_points() IS 'Automatically updates Member.totalPoints and lastActiveAt when points are awarded. Part of v2.0 gamification system (DB-07).';
