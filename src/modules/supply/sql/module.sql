CREATE TABLE supply_track
(
    atone       bigint NOT NULL,
    photon      bigint NOT NULL,
    height      BIGINT REFERENCES blocks (height),
    CONSTRAINT unique_height_balances UNIQUE (atone, photon, height)
);
CREATE INDEX supply_track_height_index ON supply_track (height DESC NULLS LAST);