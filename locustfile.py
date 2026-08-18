from locust import HttpUser, task, between

class HealthIoTUser(HttpUser):
    wait_time = between(1, 5)

    @task(3)
    def view_history_with_id(self):
        with self.client.get("/api/history?device_id=NODE-001", catch_response=True) as response:
            if response.status_code == 404 or response.status_code == 200:
                response.success()

    @task(1)
    def view_history_general(self):
        with self.client.get("/api/history", catch_response=True) as response:
            if response.status_code == 404 or response.status_code == 200:
                response.success()