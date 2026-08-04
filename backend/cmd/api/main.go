package main

import (
	"log"
	"net/http"
	"os"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"railstitch/internal/db"
	"railstitch/internal/handlers"
)

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func intParam(r *http.Request, name string) (int, bool) {
	n, err := strconv.Atoi(chi.URLParam(r, name))
	return n, err == nil
}

func main() {
	dsn := getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/railstitch_db?sslmode=disable")
	port := getenv("PORT", "8080")

	conn, err := db.Connect(dsn)
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	if err := conn.Ping(); err != nil {
		log.Fatalf("db ping: %v", err)
	}
	defer conn.Close()

	api := &handlers.API{DB: conn}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type"},
		AllowCredentials: false,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	r.Route("/api", func(r chi.Router) {
		r.Get("/routes/{routeID}/stations", func(w http.ResponseWriter, r *http.Request) {
			id, ok := intParam(r, "routeID")
			if !ok {
				http.Error(w, "invalid route id", 400)
				return
			}
			api.ListStations(w, r, id)
		})

		r.Get("/trips", api.ListTrips)
		r.Post("/trips/find-or-create", api.FindOrCreateTrip)

		r.Route("/trips/{tripID}", func(r chi.Router) {
			r.Get("/stops", func(w http.ResponseWriter, r *http.Request) {
				id, ok := intParam(r, "tripID")
				if !ok {
					http.Error(w, "invalid trip id", 400)
					return
				}
				api.ListTripStops(w, r, id)
			})
			r.Get("/availability", func(w http.ResponseWriter, r *http.Request) {
				id, ok := intParam(r, "tripID")
				if !ok {
					http.Error(w, "invalid trip id", 400)
					return
				}
				api.Availability(w, r, id)
			})
			r.Post("/bookings", func(w http.ResponseWriter, r *http.Request) {
				id, ok := intParam(r, "tripID")
				if !ok {
					http.Error(w, "invalid trip id", 400)
					return
				}
				api.CreateBooking(w, r, id)
			})
			r.Get("/bookings", func(w http.ResponseWriter, r *http.Request) {
				id, ok := intParam(r, "tripID")
				if !ok {
					http.Error(w, "invalid trip id", 400)
					return
				}
				api.ListBookings(w, r, id)
			})
			r.Post("/waitlist", func(w http.ResponseWriter, r *http.Request) {
				id, ok := intParam(r, "tripID")
				if !ok {
					http.Error(w, "invalid trip id", 400)
					return
				}
				api.CreateWaitlistEntry(w, r, id)
			})
			r.Get("/waitlist", func(w http.ResponseWriter, r *http.Request) {
				id, ok := intParam(r, "tripID")
				if !ok {
					http.Error(w, "invalid trip id", 400)
					return
				}
				api.ListWaitlist(w, r, id)
			})
		})

		r.Get("/bookings/{bookingID}", func(w http.ResponseWriter, r *http.Request) {
			id, ok := intParam(r, "bookingID")
			if !ok {
				http.Error(w, "invalid booking id", 400)
				return
			}
			api.GetBooking(w, r, id)
		})
		r.Delete("/bookings/{bookingID}", func(w http.ResponseWriter, r *http.Request) {
			id, ok := intParam(r, "bookingID")
			if !ok {
				http.Error(w, "invalid booking id", 400)
				return
			}
			api.CancelBooking(w, r, id)
		})

		// Auth
		r.Post("/auth/upsert-user", api.UpsertUser)
		r.Get("/users/{userID}/bookings", func(w http.ResponseWriter, r *http.Request) {
			userID := chi.URLParam(r, "userID")
			api.UserBookings(w, r, userID)
		})
		r.Get("/bookings/{bookingID}/verify", func(w http.ResponseWriter, r *http.Request) {
			id, ok := intParam(r, "bookingID")
			if !ok { http.Error(w, "invalid booking id", 400); return }
			api.VerifyBooking(w, r, id)
		})

		// Days off management
		r.Get("/admin/days-off", api.ListDaysOff)
		r.Post("/admin/days-off", api.AddDayOff)
		r.Get("/admin/days-off/range", api.DaysOffInRange)
		r.Delete("/admin/days-off/{day}", func(w http.ResponseWriter, r *http.Request) {
			day := chi.URLParam(r, "day")
			api.RemoveDayOff(w, r, day)
		})

		r.Get("/admin/trips/{tripID}/summary", func(w http.ResponseWriter, r *http.Request) {
			id, ok := intParam(r, "tripID")
			if !ok {
				http.Error(w, "invalid trip id", 400)
				return
			}
			api.TripSummary(w, r, id)
		})
	})

	log.Printf("listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}
