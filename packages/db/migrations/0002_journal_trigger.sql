-- Each trigger relation has a different NEW record shape. Branch before accessing fields.
CREATE OR REPLACE FUNCTION commerce.check_journal() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE j uuid; n bigint; d numeric; c numeric;
BEGIN
 IF TG_TABLE_NAME='journals' THEN j:=NEW.id; ELSE j:=NEW.journal_id; END IF;
 SELECT count(*),coalesce(sum(debit),0),coalesce(sum(credit),0) INTO n,d,c FROM commerce.ledger_entries WHERE journal_id=j;
 IF n<2 OR d<>c THEN RAISE EXCEPTION 'Unbalanced journal'; END IF;
 IF EXISTS(SELECT 1 FROM commerce.ledger_entries e JOIN commerce.ledger_accounts a ON a.id=e.account_id JOIN commerce.journals x ON x.id=e.journal_id WHERE x.id=j AND a.organization_id<>x.organization_id) THEN RAISE EXCEPTION 'Cross-tenant journal'; END IF;
 RETURN NULL;
END $$;
