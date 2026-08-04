package db

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/lib/pq"
)

// Connect establishes a connection to the PostgreSQL database
func Connect(dsn string) (*sql.DB, error) {
	conn, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("opening db: %w", err)
	}
	conn.SetMaxOpenConns(20)
	conn.SetMaxIdleConns(10)
	conn.SetConnMaxLifetime(30 * time.Minute)
	return conn, nil
}

// Reports whether err is a Postgres error indicating a unique or exclusion constraint was violated
func IsUniqueOrExclusionViolation(err error) bool {
	if err == nil {
		return false
	}
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		// 23505 = unique violation, 23P01 = exclusion violation
		return pqErr.Code == "23505" || pqErr.Code == "23P01"
	}
	return false
}
