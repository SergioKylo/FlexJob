using System;
using System.IO;
using System.Collections.Generic;
using MySqlConnector;

public static class Database
{
    private static readonly string ConnectionString = Environment.GetEnvironmentVariable("CONNECTION_STRING") 
        ?? "Server=localhost;Port=3306;Database=flexjob;Uid=root;Pwd=rootpassword;";

    private static string Hash(string password)
    {
        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var bytes = System.Text.Encoding.UTF8.GetBytes(password);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    public static void Initialize()
    {
        int maxRetries = 15;
        int delaySeconds = 3;
        MySqlConnection connection = null;

        for (int i = 1; i <= maxRetries; i++)
        {
            try
            {
                connection = new MySqlConnection(ConnectionString);
                connection.Open();
                Console.WriteLine("Successfully connected to MySQL database.");
                break;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Attempt {i}/{maxRetries}] Database not ready yet: {ex.Message}. Retrying in {delaySeconds}s...");
                if (i == maxRetries) throw;
                System.Threading.Thread.Sleep(delaySeconds * 1000);
            }
        }

        using (connection)
        {
            try
            {
                // Users table
                var createUsers = @"
                    CREATE TABLE IF NOT EXISTS users (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL UNIQUE,
                        password_hash VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL, /* worker, employer */
                        avatar VARCHAR(500),
                        bio TEXT,
                        rating DOUBLE DEFAULT 5.0,
                        wallet_balance DOUBLE DEFAULT 0,
                        location_lat DOUBLE,
                        location_lng DOUBLE,
                        created_at VARCHAR(100) NOT NULL
                    );";
                ExecuteNonQueryInternal(createUsers, null, connection);

                // Jobs table
                var createJobs = @"
                    CREATE TABLE IF NOT EXISTS jobs (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        title VARCHAR(255) NOT NULL,
                        description TEXT NOT NULL,
                        category VARCHAR(100) NOT NULL,
                        lat DOUBLE NOT NULL,
                        lng DOUBLE NOT NULL,
                        address VARCHAR(255) NOT NULL,
                        pay DOUBLE NOT NULL,
                        pay_type VARCHAR(50) NOT NULL, /* hourly, fixed */
                        duration VARCHAR(100),
                        status VARCHAR(50) NOT NULL, /* open, accepted, completed */
                        payment_status VARCHAR(50) NOT NULL DEFAULT 'none', /* none, escrowed, released */
                        payment_amount DOUBLE NOT NULL DEFAULT 0,
                        employer_id INT NOT NULL,
                        worker_id INT,
                        photo LONGTEXT, /* Base64 string for job photo */
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (employer_id) REFERENCES users(id),
                        FOREIGN KEY (worker_id) REFERENCES users(id)
                    );";
                ExecuteNonQueryInternal(createJobs, null, connection);

                // Applications table
                var createApplications = @"
                    CREATE TABLE IF NOT EXISTS applications (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        job_id INT NOT NULL,
                        worker_id INT NOT NULL,
                        status VARCHAR(50) NOT NULL, /* pending, accepted, rejected */
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (job_id) REFERENCES jobs(id),
                        FOREIGN KEY (worker_id) REFERENCES users(id),
                        UNIQUE KEY unique_job_worker (job_id, worker_id)
                    );";
                ExecuteNonQueryInternal(createApplications, null, connection);

                // Availabilities table
                var createAvailabilities = @"
                    CREATE TABLE IF NOT EXISTS availabilities (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        worker_id INT NOT NULL UNIQUE,
                        lat DOUBLE NOT NULL,
                        lng DOUBLE NOT NULL,
                        radius DOUBLE NOT NULL,
                        start_time VARCHAR(50),
                        end_time VARCHAR(50),
                        hourly_rate DOUBLE NOT NULL,
                        is_active INT NOT NULL DEFAULT 1,
                        FOREIGN KEY (worker_id) REFERENCES users(id)
                    );";
                ExecuteNonQueryInternal(createAvailabilities, null, connection);

                // Messages table
                var createMessages = @"
                    CREATE TABLE IF NOT EXISTS messages (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        from_user_id INT NOT NULL,
                        to_user_id INT NOT NULL,
                        job_id INT,
                        content TEXT NOT NULL,
                        message_type VARCHAR(50) NOT NULL DEFAULT 'text', /* text, application, payment_escrow, payment_released */
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (from_user_id) REFERENCES users(id),
                        FOREIGN KEY (to_user_id) REFERENCES users(id),
                        FOREIGN KEY (job_id) REFERENCES jobs(id)
                    );";
                ExecuteNonQueryInternal(createMessages, null, connection);

                // Reviews table
                var createReviews = @"
                    CREATE TABLE IF NOT EXISTS reviews (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        job_id INT NOT NULL,
                        from_user_id INT NOT NULL,
                        to_user_id INT NOT NULL,
                        rating DOUBLE NOT NULL,
                        comment TEXT,
                        created_at VARCHAR(100) NOT NULL,
                        FOREIGN KEY (job_id) REFERENCES jobs(id),
                        FOREIGN KEY (from_user_id) REFERENCES users(id),
                        FOREIGN KEY (to_user_id) REFERENCES users(id)
                    );";
                ExecuteNonQueryInternal(createReviews, null, connection);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error initializing database: {ex.Message}");
                throw;
            }
        }

        // Schema migrations — safe to fail if columns already exist
        try { ExecuteNonQuery("ALTER TABLE users ADD COLUMN wallet_balance DOUBLE NOT NULL DEFAULT 0"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE jobs ADD COLUMN payment_status VARCHAR(50) NOT NULL DEFAULT 'none'"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE jobs ADD COLUMN payment_amount DOUBLE NOT NULL DEFAULT 0"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE jobs ADD COLUMN work_date VARCHAR(50) NOT NULL DEFAULT ''"); } catch { }
        try { ExecuteNonQuery("ALTER TABLE messages ADD COLUMN message_type VARCHAR(50) NOT NULL DEFAULT 'text'"); } catch { }

        // Seed mock data if database is empty
        try
        {
            var usersCountResult = ExecuteQuery("SELECT COUNT(*) as count FROM users;");
            int count = Convert.ToInt32(usersCountResult[0]["count"]);
            if (count == 0)
            {
                SeedMockData();
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error seeding database: {ex.Message}");
        }
    }

    private static void SeedMockData()
    {
        Console.WriteLine("Seeding mock data into MySQL database...");
        string pwhash = Hash("123456");
        string now = DateTime.UtcNow.ToString("o");

        // 1. Seed Users (Employers & Workers)
        // Employers
        ExecuteNonQuery(@"
            INSERT INTO users (id, name, email, password_hash, role, avatar, bio, rating, location_lat, location_lng, created_at)
            VALUES 
            (1, 'Café Aurora', 'cafeaurora@email.com', @hash, 'employer', 'https://api.dicebear.com/7.x/bottts/svg?seed=CafeAurora', 'Café acolhedor no centro de Lisboa com pastelaria fina.', 4.8, 38.7109, -9.1424, @now),
            (2, 'LX Eventos', 'lxeventos@email.com', @hash, 'employer', 'https://api.dicebear.com/7.x/bottts/svg?seed=LXEventos', 'Agência líder em organização de concertos e congressos.', 4.7, 41.1496, -8.6110, @now),
            (3, 'Norte Logística', 'nortelog@email.com', @hash, 'employer', 'https://api.dicebear.com/7.x/bottts/svg?seed=NorteLog', 'Distribuição rápida e eficiente no norte de Portugal.', 4.6, 40.2056, -8.4196, @now);",
            new() { { "@hash", pwhash }, { "@now", now } });

        // Workers
        ExecuteNonQuery(@"
            INSERT INTO users (id, name, email, password_hash, role, avatar, bio, rating, location_lat, location_lng, created_at)
            VALUES 
            (4, 'Inês Costa', 'ines@email.com', @hash, 'worker', 'https://api.dicebear.com/7.x/bottts/svg?seed=Ines', 'Experiência em cafés, bar, receção de hotéis e check-in de eventos.', 4.9, 38.7240, -9.1510, @now),
            (5, 'Miguel Rocha', 'miguel@email.com', @hash, 'worker', 'https://api.dicebear.com/7.x/bottts/svg?seed=Miguel', 'Disponível para logística, armazéns, cargas leves e condução local.', 4.8, 41.1633, -8.6177, @now),
            (6, 'Sara Martins', 'sara@email.com', @hash, 'worker', 'https://api.dicebear.com/7.x/bottts/svg?seed=Sara', 'Especialista em limpezas, arrumação e organização doméstica.', 4.7, 40.1989, -8.4043, @now),
            (7, 'Beatriz Santos', 'beatriz@email.com', @hash, 'worker', 'https://api.dicebear.com/7.x/bottts/svg?seed=Beatriz', 'Estudante de hotelaria focada em atendimento ao cliente e retalho.', 4.8, 38.7355, -9.1432, @now);",
            new() { { "@hash", pwhash }, { "@now", now } });

        // 2. Seed Availabilities for Workers
        ExecuteNonQuery(@"
            INSERT INTO availabilities (worker_id, lat, lng, radius, start_time, end_time, hourly_rate, is_active)
            VALUES
            (4, 38.7240, -9.1510, 10.0, '09:00', '18:00', 10.0, 1),
            (5, 41.1633, -8.6177, 15.0, '08:00', '20:00', 11.5, 1),
            (6, 40.1989, -8.4043, 8.0, '14:00', '19:00', 9.0, 1),
            (7, 38.7355, -9.1432, 5.0, '10:00', '17:00', 10.0, 1);");

        // 3. Seed Jobs (Some open, some completed)
        // Photos are stored as simple base64 patterns or SVG data urls
        string coffeeShopPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'><rect width='100%' height='100%' fill='%236F4E37'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='white'>Café Aurora Vaga</text></svg>";
        string eventPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'><rect width='100%' height='100%' fill='%231F2937'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='white'>Montagem de Palco</text></svg>";
        string logPhoto = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='250' viewBox='0 0 400 250'><rect width='100%' height='100%' fill='%23065F46'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='24' fill='white'>Armazém Logística</text></svg>";

        ExecuteNonQuery(@"
            INSERT INTO jobs (id, title, description, category, lat, lng, address, pay, pay_type, duration, status, employer_id, worker_id, photo, created_at)
            VALUES
            (1, 'Apoio de Mesa no Chiado', 'Servir mesas, acolher clientes e recolher pratos no horário de almoço.', 'restauracao', 38.7109, -9.1424, 'Rua Garrett 15, Chiado, Lisboa', 11.0, 'hourly', '4 horas', 'open', 1, NULL, @coffeePhoto, @now),
            (2, 'Montagem de Festival Porto', 'Apoio na montagem de stands de comida, cadeiras e grades de proteção.', 'eventos', 41.1496, -8.6110, 'Parque da Cidade, Porto', 12.0, 'hourly', '6 horas', 'open', 2, NULL, @eventPhoto, @now),
            (3, 'Cargas e Descargas Coimbra', 'Organização de caixotes no armazém principal e descarga de camião local.', 'logistica', 40.2056, -8.4196, 'Zona Industrial da Pedrulha, Coimbra', 10.0, 'hourly', '3 horas', 'open', 3, NULL, @logPhoto, @now),
            (4, 'Limpeza de Cozinha Exaustiva', 'Limpeza profunda de bancadas, fornos e louças após evento privado.', 'casa', 38.7109, -9.1424, 'Rua de São Paulo, Cais do Sodré, Lisboa', 13.5, 'hourly', '4 horas', 'completed', 1, 4, @coffeePhoto, @now),
            (5, 'Ajudante de Inventário Loja', 'Contagem manual de stock de vestuário na loja e etiquetagem.', 'retalho', 41.1496, -8.6110, 'Rua de Santa Catarina, Porto', 9.5, 'hourly', '8 horas', 'completed', 2, 5, @eventPhoto, @now);",
            new() { 
                { "@coffeePhoto", coffeeShopPhoto }, 
                { "@eventPhoto", eventPhoto }, 
                { "@logPhoto", logPhoto },
                { "@now", now } 
            });

        // 4. Seed Reviews for completed jobs
        ExecuteNonQuery(@"
            INSERT INTO reviews (job_id, from_user_id, to_user_id, rating, comment, created_at)
            VALUES
            (4, 1, 4, 4.9, 'A Inês foi fantástica! Limpeza impecável e postura super profissional.', @now),
            (5, 2, 5, 4.8, 'O Miguel ajudou imenso no inventário, rápido e muito atento a detalhes.', @now);",
            new() { { "@now", now } });

        // 5. Seed Messages between employers and workers
        ExecuteNonQuery(@"
            INSERT INTO messages (from_user_id, to_user_id, job_id, content, created_at)
            VALUES
            (4, 1, 1, 'Olá! Vi a vossa vaga para apoio no Chiado. Tenho total disponibilidade para a hora de almoço.', @now),
            (1, 4, 1, 'Excelente Inês! Já trabalhaste com sistemas de registo de pedidos no telemóvel?', @now),
            (4, 1, 1, 'Sim, no meu último trabalho usávamos a aplicação WinRest. Estou bastante habituada!', @now),
            (5, 2, 2, 'Boa tarde. Consigo ajudar na montagem de stands no Porto. Levo botas de segurança.', @now),
            (2, 5, 2, 'Perfeito Miguel! O ponto de encontro é perto do palco principal às 10h. Até amanhã!', @now);",
            new() { { "@now", now } });

        Console.WriteLine("Database seeding completed successfully!");
    }

    public static int ExecuteNonQuery(string sql, Dictionary<string, object> parameters = null)
    {
        using var connection = new MySqlConnection(ConnectionString);
        connection.Open();
        return ExecuteNonQueryInternal(sql, parameters, connection);
    }

    private static int ExecuteNonQueryInternal(string sql, Dictionary<string, object> parameters, MySqlConnection connection)
    {
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
            }
        }
        return command.ExecuteNonQuery();
    }

    public static List<Dictionary<string, object>> ExecuteQuery(string sql, Dictionary<string, object> parameters = null)
    {
        var results = new List<Dictionary<string, object>>();
        using var connection = new MySqlConnection(ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = sql;
        if (parameters != null)
        {
            foreach (var param in parameters)
            {
                command.Parameters.AddWithValue(param.Key, param.Value ?? DBNull.Value);
            }
        }

        using var reader = command.ExecuteReader();
        while (reader.Read())
        {
            var row = new Dictionary<string, object>();
            for (int i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null : reader.GetValue(i);
            }
            results.Add(row);
        }
        return results;
    }

    public static long GetLastInsertRowId()
    {
        using var connection = new MySqlConnection(ConnectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = "SELECT LAST_INSERT_ID();";
        return Convert.ToInt64(command.ExecuteScalar());
    }
}
