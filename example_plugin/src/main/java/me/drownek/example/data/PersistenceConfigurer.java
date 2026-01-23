package me.drownek.example.data;

import com.zaxxer.hikari.HikariConfig;
import eu.okaeri.configs.json.simple.JsonSimpleConfigurer;
import eu.okaeri.persistence.PersistencePath;
import eu.okaeri.persistence.document.DocumentPersistence;
import eu.okaeri.persistence.jdbc.MariaDbPersistence;
import eu.okaeri.persistence.jdbc.PostgresPersistence;
import me.drownek.example.config.PluginConfig;
import me.drownek.platform.bukkit.persistence.YamlBukkitPersistence;
import me.drownek.platform.bukkit.serdes.SerdesBukkit;
import me.drownek.platform.core.annotation.Bean;
import me.drownek.platform.core.annotation.Component;
import org.bukkit.plugin.Plugin;

import java.io.File;

@Component
public class PersistenceConfigurer {

    @Bean(value = "persistence")
    public DocumentPersistence configurePersistence(Plugin plugin, PluginConfig config) {

        // remember that if plugin is not intended to have shared state
        // between multiple instances you must allow users to set persistence's
        // basePath manually or add some other possibility to differ keys
        PersistencePath basePath = PersistencePath.of(config.storage.prefix);

        // multiple backends are possible with an easy switch
        switch (config.storage.backend) {
            case FLAT:
                // specify custom child dir in dataFolder or other custom location
                // or use YamlBukkitPersistence.of(plugin) for default pluginFolder/storage/* (best used for simplest plugins with single storage backend)
                // same as: new DocumentPersistence(new FlatPersistence(new File(dataFolder, "storage"), ".yml"), YamlBukkitConfigurer::new, new SerdesBukkit())
                return YamlBukkitPersistence.of(new File(plugin.getDataFolder(), "storage"));
            case MYSQL:
                // setup hikari based on your needs, e.g. using config
                HikariConfig mariadbHikari = new HikariConfig();
                mariadbHikari.setJdbcUrl(config.storage.uri);
                mariadbHikari.setUsername(config.storage.user);
                mariadbHikari.setPassword(config.storage.password);
                // it is REQUIRED to use json configurer for the mariadb backend
                return new DocumentPersistence(new MariaDbPersistence(basePath, mariadbHikari), JsonSimpleConfigurer::new, new SerdesBukkit());
            case POSTGRES:
                // setup hikari based on your needs, e.g. using config
                HikariConfig postgresHikari = new HikariConfig();
                postgresHikari.setJdbcUrl(config.storage.uri);
                postgresHikari.setUsername(config.storage.user);
                postgresHikari.setPassword(config.storage.password);
                postgresHikari.setDriverClassName("org.postgresql.Driver");
                // it is REQUIRED to use json configurer for the mariadb backend
                return new DocumentPersistence(new PostgresPersistence(basePath, postgresHikari), JsonSimpleConfigurer::new, new SerdesBukkit());
            default:
                throw new IllegalStateException("Unexpected value: " + config.storage.backend);
        }
    }
}
